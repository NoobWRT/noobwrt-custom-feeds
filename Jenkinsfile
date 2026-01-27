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
                    sh '''
                        bash ${SCRIPTS_DIR}/clone-sync-packages.sh
                    '''
                }
            }
        }
        
        stage('Validate Packages') {
            steps {
                script {
                    echo '✅ Validating packages...'
                    sh '''
                        bash ${SCRIPTS_DIR}/validate-packages.sh
                    '''
                }
            }
        }
        
        stage('Check Changes') {
            steps {
                script {
                    echo '🔔 Checking for changes...'
                    sh '''
                        bash ${SCRIPTS_DIR}/check-changes.sh
                    '''
                    script {
                        env.CHANGES_DETECTED = readFile(file: '.changes-detected').trim()
                    }
                }
            }
        }
        
        stage('Commit & Push') {
            when {
                expression { 
                    return env.CHANGES_DETECTED == 'true' || params.FORCE_SYNC == true
                }
            }
            steps {
                script {
                    echo '📤 Committing and pushing changes...'
                    withCredentials([usernamePassword(credentialsId: 'github-credentials', usernameVariable: 'GIT_USER', passwordVariable: 'GIT_PASS')]) {
                        sh '''
                            bash ${SCRIPTS_DIR}/commit-push.sh
                        '''
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
