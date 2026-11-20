#!/bin/sh
# SPDX-License-Identifier: GPL-2.0
# Regression for SMS order (issue #5): ModemManager gives a sent SMS no
# timestamp, so the inbox must use the time we sent it, not the time the page
# happened to read the list.
#
# Also covers the review points: two sends of the same text keep their own
# times, concurrent sends both land, a ModemManager restart during a send or a
# listing never mixes generations, a delivered message never uses the send
# store, an inbound message without a time turns read and a new one is unread,
# and a send still succeeds when its time cannot be recorded.
#
# Needs a libubox jshn (the router has one at /usr/share/libubox/jshn.sh) and
# busybox (for `date -D`); set AW1000_JSHN to another jshn.sh to run from a
# build tree. The script under test runs with /bin/sh so the stubs below are
# used: BusyBox ash runs its own applets before PATH.
set -u

here=$(cd "$(dirname "$0")" && pwd)
src=$here/../files/aw1000-voice-sms
jshn=${AW1000_JSHN:-/usr/share/libubox/jshn.sh}

[ -f "$jshn" ] || { echo "skip: no $jshn (set AW1000_JSHN)"; exit 0; }
command -v jshn >/dev/null 2>&1 || { echo "skip: no jshn in PATH"; exit 0; }
command -v busybox >/dev/null 2>&1 || { echo "skip: no busybox in PATH"; exit 0; }

T=$(mktemp -d "${TMPDIR:-/tmp}/aw1000-sms-order.XXXXXX") || exit 1
trap 'rm -rf "$T"' EXIT
export T
mkdir -p "$T/state" "$T/bin"
mkdir -m 700 "$T/run"

fail() { echo "FAIL $*"; exit 1; }
ok() { echo "ok   $*"; }

# A generation is the ModemManager pid and its /proc start time. Use this test
# shell as the "daemon" (alive, with a real /proc entry) and pid 1 as the
# restarted one; pid_max + 1 is the unreadable case.
gen_of() { printf '%s:%s' "$1" "$(sed 's/^.*) //' "/proc/$1/stat" | cut -d' ' -f20)"; }
gen=$(gen_of $$)
other=$(gen_of 1)
max=$(cat /proc/sys/kernel/pid_max 2>/dev/null)
case "$max" in ''|*[!0-9]*) max=4194304 ;; esac
printf '%s\n' "$$" > "$T/genpid"
printf '%s\n' 1 > "$T/nextpid"

cat > "$T/bin/mmcli" <<'EOF'
#!/bin/sh
# Fixture: 12 and 14 delivered, 13 and 11 sent, 15 delivered without a time.
# 16 appears only when asked. A created SMS gets the next free object number
# and keeps its text for the list reply. The list is in storage order, not
# arrival order. A restart can be forced before or during a listing.
flip() { cat "$T/nextpid" > "$T/genpid"; }
ago() { date -d "@$(( $(date +%s) - $1 * 60 ))" '+%Y-%m-%dT%H:%M:%S'; }
json() {
	case "$1" in
	12) printf '{"sms":{"content":{"number":"+94771234567","text":"MSG2"},"properties":{"timestamp":"%s","state":"received","pdu-type":"deliver","storage":"sm"}}}\n' "$(ago 4)" ;;
	14) printf '{"sms":{"content":{"number":"+94771234567","text":"MSG4"},"properties":{"timestamp":"%s","state":"received","pdu-type":"deliver","storage":"sm"}}}\n' "$(ago 2)" ;;
	15) echo '{"sms":{"content":{"number":"+94771234567","text":"MSGIN"},"properties":{"state":"received","pdu-type":"deliver","storage":"sm"}}}' ;;
	16) echo '{"sms":{"content":{"number":"+94771234567","text":"MSGIN2"},"properties":{"state":"received","pdu-type":"deliver","storage":"sm"}}}' ;;
	13) echo '{"sms":{"content":{"number":"+94771234567","text":"MSG3"},"properties":{"state":"sent","pdu-type":"submit","storage":"me"}}}' ;;
	11) echo '{"sms":{"content":{"number":"+94771234567","text":"MSG1"},"properties":{"state":"sent","pdu-type":"submit","storage":"me"}}}' ;;
	*) [ -f "$T/text.$1" ] && printf '{"sms":{"content":{"number":"+94771234567","text":"%s"},"properties":{"state":"sent","pdu-type":"submit","storage":"me"}}}\n' "$(cat "$T/text.$1")" ;;
	esac
}

case "$1" in
-L) echo "    /org/freedesktop/ModemManager1/Modem/0" ;;
-m)
	case "$3" in
	--messaging-list-sms)
		for i in 12 14 13 11 15; do echo "    /org/freedesktop/ModemManager1/SMS/$i"; done
		[ -f "$T/have16" ] && echo "    /org/freedesktop/ModemManager1/SMS/16"
		for d in "$T"/seq.*; do [ -d "$d" ] && echo "    /org/freedesktop/ModemManager1/SMS/${d##*.}"; done ;;
	--messaging-create-sms=*)
		# busybox mkdir, not the host's: some coreutils builds (uutils) report
		# success for a concurrent mkdir on the same path, which would give two
		# sends one number.
		id=100
		while ! busybox mkdir "$T/seq.$id" 2>/dev/null; do id=$((id + 1)); done
		for a in "$@"; do
			case "$a" in --messaging-create-sms-with-text=*) f=${a#*=} ;; esac
		done
		cat "$f" > "$T/text.$id"
		echo "    /org/freedesktop/ModemManager1/SMS/$id" ;;
	esac ;;
-s)
	case "$3" in
	-J)
		if [ "$2" = 13 ] && [ -f "$T/flip-list" ]; then rm -f "$T/flip-list"; flip; fi
		json "$2" ;;
	--send)
		if [ -f "$T/flip-send" ]; then rm -f "$T/flip-send"; flip; fi
		echo "successfully sent" ;;
	esac ;;
esac
EOF
cat > "$T/bin/pidof" <<'EOF'
#!/bin/sh
case "$1" in ModemManager) cat "$T/genpid" ;; *) exit 1 ;; esac
EOF
printf '#!/bin/sh\nexec busybox date "$@"\n' > "$T/bin/date"
printf '#!/bin/sh\nexit 0\n' > "$T/bin/logger"
printf '#!/bin/sh\nexit 0\n' > "$T/bin/uci"
chmod +x "$T/bin"/*

# When MSG1 and MSG3 went out; an entry for MSGIN proves a delivered message
# never uses the send store. Relative to now, so the seven day expiry cannot
# age the fixture out.
start=$(date +%s)
mkdir -p "$T/run/$gen"
printf '%s\n' "$((start - 300))" > "$T/run/$gen/sent.11"
printf '%s\n' "$((start - 180))" > "$T/run/$gen/sent.13"
printf '%s\n' "$((start - 60))" > "$T/run/$gen/sent.15"
chmod 600 "$T/run/$gen"/sent.*

# Run the real script with its state and runtime dirs pointed at the fixture.
sed -e "s#^\. /usr/share/libubox/jshn.sh#. $jshn#" \
	-e "s#/etc/aw1000-voice#$T/state#g" \
	-e "s#^RUN=/var/run/aw1000-voice-sms#RUN=$T/run#" "$src" > "$T/sms"
chmod +x "$T/sms"
list() { PATH="$T/bin:$PATH" sh "$T/sms" list; }
send() { PATH="$T/bin:$PATH" sh "$T/sms" send "$@"; }
obj() { printf '%s' "$1" | tr '{' '\n' | grep "\"index\": $2,"; }
time_of() { obj "$1" "$2" | sed -n 's/.*"time": \([0-9]*\).*/\1/p'; }
is_unread() { obj "$1" "$2" | grep -q '"unread": true'; }

out=$(list) || fail "list did not run"
order=$(printf '%s' "$out" | tr '{' '\n' |
	sed -n 's/.*"time": \([0-9]*\).*"text": "\(MSG[1-4]\)".*/\1 \2/p' |
	sort -n | awk '{ printf "%s ", $2 }')
[ "$order" = "MSG1 MSG2 MSG3 MSG4 " ] ||
	fail "order is '$order', want 'MSG1 MSG2 MSG3 MSG4 '"
ok "sent SMS use their send time: $order"

[ "$(time_of "$out" 11)" = "$((start - 300))" ] || fail "MSG1 time is not its send time"
[ "$(time_of "$out" 13)" = "$((start - 180))" ] || fail "MSG3 time is not its send time"
ok "a recorded time is used, not the time of the read"

# A delivered message with no timestamp: unknown time, unread, and the seeded
# entry for 15 must not be used. The first sighting is remembered.
[ "$(time_of "$out" 15)" = 0 ] || fail "a delivered message used the send store"
is_unread "$out" 15 || fail "inbound with no time is not unread"
[ -f "$T/run/$gen/seen.15" ] || fail "first sighting of an undated inbound was not remembered"
ok "inbound with no time stays unknown and unread"

# Mark all read, then that message must be read; one that appears afterwards
# must be unread again.
PATH="$T/bin:$PATH" sh "$T/sms" read >/dev/null || fail "read did not run"
out=$(list)
is_unread "$out" 15 && fail "mark read did not clear the undated message"
sleep 1
touch "$T/have16"
out=$(list)
is_unread "$out" 16 || fail "a new undated message is not unread"
is_unread "$out" 15 && fail "an old undated message became unread again"
ok "mark read clears an undated message and a later one is unread"

# Same text twice: each send has its own object number and time.
printf 'SAME' > "$T/same1"
send "+94771234567" "$T/same1" >/dev/null || fail "first send"
sleep 1
printf 'SAME' > "$T/same2"
send "+94771234567" "$T/same2" >/dev/null || fail "second send"
ids=$(for d in "$T"/seq.*; do [ -d "$d" ] && echo "${d##*.}"; done)
# shellcheck disable=SC2086 # ids is a whitespace-separated list of numbers
set -- $ids
[ "$#" -eq 2 ] || fail "expected 2 sends, saw $#"
ta=$(cat "$T/run/$gen/sent.$1" 2>/dev/null)
tb=$(cat "$T/run/$gen/sent.$2" 2>/dev/null)
[ -n "$ta" ] && [ -n "$tb" ] || fail "identical sends were not both recorded"
[ "$ta" != "$tb" ] || fail "identical sends share one time ($ta)"
now=$(date +%s)
for t in "$ta" "$tb"; do
	[ "$t" -ge $((now - 15)) ] && [ "$t" -le $((now + 2)) ] || fail "send time $t is not accurate"
done
out=$(list)
[ "$(time_of "$out" "$1")" = "$ta" ] && [ "$(time_of "$out" "$2")" = "$tb" ] ||
	fail "the two identical sends do not use their own times"
ok "identical texts keep distinct, accurate times"

# Two sends at once: each writes its own record, with no shared file or lock.
before=$(ls "$T/run/$gen"/sent.* 2>/dev/null | wc -l)
printf 'RACE' > "$T/race1"
printf 'RACE' > "$T/race2"
send "+94771234567" "$T/race1" >/dev/null 2>&1 &
p1=$!
send "+94771234567" "$T/race2" >/dev/null 2>&1 &
p2=$!
wait $p1 || fail "concurrent send 1 failed"
wait $p2 || fail "concurrent send 2 failed"
after=$(ls "$T/run/$gen"/sent.* 2>/dev/null | wc -l)
[ "$((after - before))" -eq 2 ] || fail "concurrent sends recorded $((after - before)), want 2"
ok "concurrent sends are both recorded"

# A restart between creating and sending: the modem has sent it, so the reply
# is still ok, but the number belongs to the old daemon and is not recorded.
touch "$T/flip-send"
before=$(ls "$T/run/$gen"/sent.* 2>/dev/null | wc -l)
printf 'RESTART' > "$T/restart"
out=$(send "+94771234567" "$T/restart" 2>&1)
st=$?
[ "$st" = 0 ] && [ "$out" = ok ] || fail "send during a restart replied '$out' (exit $st)"
after=$(ls "$T/run/$gen"/sent.* 2>/dev/null | wc -l)
[ "$after" = "$before" ] || fail "a time was recorded across generations"
printf '%s\n' "$$" > "$T/genpid"
ok "a send across a restart still succeeds and records nothing"

# A restart during a listing: the reply is rebuilt with the new generation, so
# no old number is attached to a message. The delivered time stays.
touch "$T/flip-list"
out=$(list)
[ "$(time_of "$out" 11)" = 0 ] && [ "$(time_of "$out" 13)" = 0 ] ||
	fail "stale times survived a generation change while listing"
[ "$(time_of "$out" 12)" != 0 ] || fail "a delivered time was lost"
printf '%s\n' "$$" > "$T/genpid"
ok "a generation change while listing never applies old times"

# No readable generation (no pid or no start time) means no cache at all:
# unknown sent times, base unread for an undated inbound, and a send that still
# answers ok.
printf '%s\n' "$((max + 1))" > "$T/genpid"
out=$(list)
[ "$(time_of "$out" 11)" = 0 ] && [ "$(time_of "$out" 13)" = 0 ] ||
	fail "a cache was used without a generation"
is_unread "$out" 16 || fail "an undated inbound lost its unread flag"
printf 'NOGEN' > "$T/nogen"
out=$(send "+94771234567" "$T/nogen" 2>&1)
st=$?
[ "$st" = 0 ] && [ "$out" = ok ] || fail "send without a generation replied '$out' (exit $st)"
printf '%s\n' "$$" > "$T/genpid"
ok "no generation fails closed for reads and sends"

# A send must succeed even when its time cannot be stored at all.
printf x > "$T/blocked"
sed -e "s#^\. /usr/share/libubox/jshn.sh#. $jshn#" \
	-e "s#/etc/aw1000-voice#$T/state#g" \
	-e "s#^RUN=/var/run/aw1000-voice-sms#RUN=$T/blocked#" "$src" > "$T/sms-bad"
chmod +x "$T/sms-bad"
printf 'NOSTORE' > "$T/ns"
out=$(PATH="$T/bin:$PATH" sh "$T/sms-bad" send "+94771234567" "$T/ns" 2>&1)
st=$?
[ "$st" = 0 ] && [ "$out" = ok ] ||
	fail "send with an unwritable store replied '$out' (exit $st)"
ok "a failed time record does not change the send reply"

# An older send that passed its generation check just before a restart may
# resume after the newer generation has written. Pruning must then drop only
# generations strictly older than the caller, never the newer one; an equal
# start tick, a symlink and names that are not pid:start all stay.
mytick=${gen#*:}
otick=${other#*:}
[ "$otick" -lt "$mytick" ] || fail "fixture: pid 1 did not start before this shell"
newer="999999:$((mytick + 1000))"
equal="987654:$mytick"
for d in "$other" "$newer" "$equal" "notagen" "123:abc" "123:" "123"; do
	mkdir -p "$T/run/$d"
	printf 1 > "$T/run/$d/sent.900"
done
mkdir "$T/keepdir"
printf 1 > "$T/keepdir/sent.999"
ln -s "$T/keepdir" "$T/run/888:1"
printf 1 > "$T/run/plainfile"
printf 'PRUNE' > "$T/prune"
send "+94771234567" "$T/prune" >/dev/null || fail "prune send failed"
[ -d "$T/run/$other" ] && fail "a generation older than the caller was not pruned"
[ -d "$T/run/$gen" ] || fail "the caller's generation was pruned"
[ -d "$T/run/$newer" ] || fail "a newer generation was pruned"
[ -d "$T/run/$equal" ] || fail "an equal start tick was pruned"
[ -d "$T/run/notagen" ] && [ -d "$T/run/123:abc" ] && [ -d "$T/run/123:" ] &&
	[ -d "$T/run/123" ] ||
	fail "a non-generation name was pruned"
[ -L "$T/run/888:1" ] || fail "a generation symlink was removed"
[ -f "$T/keepdir/sent.999" ] || fail "a generation symlink was followed"
[ -f "$T/run/plainfile" ] || fail "a plain file was removed"
ok "pruning drops only strictly older numeric generations"
