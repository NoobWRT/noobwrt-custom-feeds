pipeline {
    agent any
    
    parameters {
        booleanParam(name: 'FORCE_SYNC', defaultValue: false, description: 'Force sync even if no changes detected')
    }
    
    environment {
        REPO_URL = 'https://github.com/FUjr/QModem.git'
        SCRIPTS_DIR = './scripts'
        PACKAGES_DIR = './packages'
        TEMP_DIR = './temp_qmodem'
        GIT_AUTHOR_NAME = 'Jenkins CI'
        GIT_AUTHOR_EMAIL = 'jenkins@example.com'
    }
    
    options {
        timestamps()
        timeout(time: 1, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }
    
    triggers {
        // Run daily at 2 AM UTC (adjust timezone as needed)
        cron('0 2 * * *')
    }
    
    stages {
        stage('Checkout') {
            steps {
                script {
                    echo '🔍 Checking out repository...'
                    checkout scm
                    
                    // Ensure we're on the main branch
                    sh '''
                        echo "Current branch info:"
                        git branch -a
                        git log --oneline -1
                        
                        # Check if we're in detached HEAD state
                        if git symbolic-ref -q HEAD; then
                            echo "✓ On a branch: $(git branch --show-current)"
                        else
                            echo "⚠️  In detached HEAD state, checking out main..."
                            git checkout -B main origin/main || git checkout -B main
                        fi
                    '''
                }
            }
        }
        
        stage('Configure Git') {
            steps {
                script {
                    echo '⚙️ Configuring Git...'
                    sh '''
                        bash ${SCRIPTS_DIR}/configure-git.sh
                    '''
                }
            }
        }
        
        stage('Sync QModem') {
            steps {
                script {
                    echo 'Syncing QModem packages using generic script...'
                    def syncResult = sh(
                        script: '''
                          SYNC_REPO_URL="https://github.com/FUjr/QModem.git" \
                          SYNC_REMOTE_PATH="luci" \
                          SYNC_DEST_DIR="packages/QModem" \
                          SYNC_COPY_SUBDIRS=true \
                          bash ${SCRIPTS_DIR}/sync/sync-repo.sh
                        ''',
                        returnStatus: true
                    )
                    if (syncResult != 0) {
                        error("Package sync failed with exit code ${syncResult}")
                    }
                }
            }
        }

        stage('Sync Internet Detector') {
            steps {
                script {
                    echo 'Syncing Internet Detector using generic script...'
                    def syncInternet = sh(
                        script: '''
                          SYNC_REPO_URL="https://github.com/gSpotx2f/luci-app-internet-detector.git" \
                          SYNC_REMOTE_PATH="." \
                          SYNC_DEST_DIR="packages/internet_detector" \
                          SYNC_COPY_SUBDIRS=false \
                          SYNC_CLEAN_DEST=true \
                          bash ${SCRIPTS_DIR}/sync/sync-repo.sh
                        ''',
                        returnStatus: true
                    )
                    if (syncInternet != 0) {
                        error("Internet detector sync failed with exit code ${syncInternet}")
                    }
                }
            }
        }
        
        stage('Validate Packages') {
            steps {
                script {
                    echo 'Validating packages...'
                    def validateResult = sh(
                        script: 'bash ${SCRIPTS_DIR}/validate-packages.sh',
                        returnStatus: true
                    )
                    if (validateResult != 0) {
                        error("Package validation failed with exit code ${validateResult}")
                    }
                }
            }
        }
        
        stage('Check Changes') {
            steps {
                script {
                    echo 'Checking for changes...'
                    sh 'bash ${SCRIPTS_DIR}/check-changes.sh'
                    
                    env.CHANGES_DETECTED = readFile(file: '.changes-detected').trim()
                    echo "Changes detected: ${env.CHANGES_DETECTED}"
                }
            }
        }
        
        stage('Commit & Push') {
            steps {
                script {
                    echo 'Committing and pushing changes...'
                    echo "CHANGES_DETECTED = ${env.CHANGES_DETECTED}"
                    echo "FORCE_SYNC = ${params.FORCE_SYNC}"
                    
                    // Use GitHub token for authentication
                    withCredentials([string(credentialsId: 'github-token-nooblk98', variable: 'GITHUB_TOKEN')]) {
                        def pushResult = sh(
                            script: '''
                                git remote set-url origin https://${GITHUB_TOKEN}@github.com/nooblk-98/noobwrt-custom-feeds.git
                                bash ${SCRIPTS_DIR}/commit-push.sh
                            ''',
                            returnStatus: true
                        )
                        echo "Push script exit code: ${pushResult}"
                    }
                }
            }
        }
        
        stage('Cleanup') {
            steps {
                script {
                    echo 'Cleaning up temporary files...'
                    sh '''
                        bash ${SCRIPTS_DIR}/cleanup.sh
                    '''
                }
            }
        }
    }
    
    post {
        always {
            echo 'Build finished'
        }
        success {
            echo 'Sync completed successfully'
        }
        failure {
            echo 'Sync failed - check logs for details'
        }
    }
}
