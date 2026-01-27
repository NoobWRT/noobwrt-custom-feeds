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
        
        stage('Clone & Sync') {
            steps {
                script {
                    echo '📥 Cloning and syncing QModem repository...'
                    def syncResult = sh(
                        script: 'bash ${SCRIPTS_DIR}/clone-sync-packages.sh',
                        returnStatus: true
                    )
                    if (syncResult != 0) {
                        error("Package sync failed with exit code ${syncResult}")
                    }
                }
            }
        }
        
        stage('Validate Packages') {
            steps {
                script {
                    echo '✅ Validating packages...'
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
                    echo '🔔 Checking for changes...'
                    sh 'bash ${SCRIPTS_DIR}/check-changes.sh'
                    
                    env.CHANGES_DETECTED = readFile(file: '.changes-detected').trim()
                    echo "Changes detected: ${env.CHANGES_DETECTED}"
                }
            }
        }
        
        stage('Commit & Push') {
            steps {
                script {
                    echo '📤 Committing and pushing changes...'
                    echo "CHANGES_DETECTED = ${env.CHANGES_DETECTED}"
                    echo "FORCE_SYNC = ${params.FORCE_SYNC}"
                    
                    // Always run commit-push for new packages, not just modified ones
                    withCredentials([usernamePassword(credentialsId: 'github-credentials', usernameVariable: 'GIT_USER', passwordVariable: 'GIT_PASS')]) {
                        def pushResult = sh(
                            script: 'bash ${SCRIPTS_DIR}/commit-push.sh',
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
                    echo '🧹 Cleaning up temporary files...'
                    sh '''
                        bash ${SCRIPTS_DIR}/cleanup.sh
                    '''
                }
            }
        }
    }
    
    post {
        always {
            echo '📊 Build finished'
        }
        success {
            echo '✅ Sync completed successfully'
        }
        failure {
            echo '❌ Sync failed - check logs for details'
        }
    }
}
