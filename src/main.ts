import * as core from '@actions/core'
import axios from 'axios'

interface IConfig {
  REPO_NAME: string
  DOCKER_USER: string
  DOCKER_PASS: string
  DOCKER_IMAGE_NAME: string
  TAG: string
  CLUSTER_API_URL: string
  CLUSTER_AUTH_TOKEN: string
  CLUSTER_CONTAINER_NAME: string
  HOST_PORT: string
  SLACK_WEBHOOK: string
  [key: string]: string
}

async function run(): Promise<void> {
  try {
    const REPOSITORY = core.getInput('REPOSITORY')
    const ACCESS_TOKEN = core.getInput('ACCESS_TOKEN')

    // Authenticate With Config Service
    const configSvcToken = await configServiceAuth(ACCESS_TOKEN)

    // Fetch Repository Config
    const config: IConfig = await getRepoConfig(REPOSITORY, configSvcToken)

    for (const key in config) {
      core.setOutput(key, `${config[key]}`)
    }
  } catch (e) {
    core.setFailed(e.message)
  }
}

async function configServiceAuth(gitAccessToken: string): Promise<string> {
  const {data} = await axios
    .post('https://config.chipserver.ml/auth/github', {
      token: gitAccessToken
    })
    .catch(async (e: Error) => {
      return Promise.reject(e)
    })

  const {access_token: accessToken} = data

  if (!accessToken) {
    return Promise.reject(
      new Error('Unable to authenticate using github token')
    )
  }

  return accessToken
}

async function getRepoConfig(
  repo: string,
  configServiceToken: string
): Promise<IConfig> {
  const {data} = await axios
    .get(`https://config.chipserver.ml/api/v1/config/${repo}`, {
      headers: {
        Authorization: `Bearer ${configServiceToken}`
      }
    })
    .catch(async (e: Error) => {
      return Promise.reject(e)
    })

  if (!data) {
    return Promise.reject(new Error('Unable to fetch repo config'))
  }

  return data
}

run()
