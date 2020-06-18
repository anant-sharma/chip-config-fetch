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
    // const REPOSITORY = process.env.GITHUB_REPOSITORY || ''
    const REPOSITORY = 'anant-sharma/auth-service'
    const ACCESS_TOKEN = core.getInput('access_token')
    const deploy = +core.getInput('deploy')

    // Authenticate With Config Service
    const configSvcToken = await configServiceAuth(ACCESS_TOKEN)

    // Fetch Repository Config
    const config: IConfig = await getRepoConfig(REPOSITORY, configSvcToken)

    if (deploy) {
      await deployService(config)
    }

    for (const key in config) {
      core.debug(`${key}: ${config[key]}`)
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

async function deployService(config: IConfig): Promise<void> {
  const cAxios = axios.create({
    baseURL: `${config.CLUSTER_API_URL}/endpoints/1/docker`,
    headers: {
      Authorization: `Bearer ${config.CLUSTER_AUTH_TOKEN}`
    }
  })

  try {
    // Pull New Image
    await cAxios({
      method: 'post',
      url: '/images/create',
      params: {
        fromImage: `${config.DOCKER_USER}/${config.DOCKER_IMAGE_NAME}`,
        tag: config.TAG
      },
      data: {}
    })
    core.debug('Image Pull Complete')

    // Remove Old Image
    await cAxios({
      method: 'delete',
      url: `/containers/${config.CLUSTER_CONTAINER_NAME}`,
      params: {
        v: true,
        force: true
      },
      data: {}
    }).catch(() => {})
    core.debug('Remove Old Complete')

    // Create New Container
    await cAxios({
      method: 'post',
      url: `/containers/create`,
      params: {
        name: config.CLUSTER_CONTAINER_NAME
      },
      data: {
        Image: `${config.DOCKER_USER}/${config.DOCKER_IMAGE_NAME}:${config.TAG}`,
        ExposedPorts: {
          '8080/tcp': {}
        },
        HostConfig: {
          PortBindings: {
            '8080/tcp': [
              {
                HostPort: `${config.HOST_PORT}`
              }
            ]
          },
          PublishAllPorts: true,
          AutoRemove: true,
          NetworkMode: 'bridge'
        },
        name: config.CLUSTER_CONTAINER_NAME
      }
    })
    core.debug('Create New Complete')

    // Start New Container
    await cAxios({
      method: 'post',
      url: `/containers/${config.CLUSTER_CONTAINER_NAME}/start`,
      params: {},
      data: {}
    })
    core.debug('Start New Complete')

    return
  } catch (e) {
    return Promise.reject(e)
  }
}

run()
