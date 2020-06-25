import * as core from '@actions/core'
import axios, {AxiosInstance, AxiosResponse} from 'axios'

interface INull {
  [key: string]: string | Object
}

interface IConfig {
  REPO_NAME: string
  DOCKER_USER: string
  DOCKER_PASS: string
  DOCKER_IMAGE_NAME: string
  TAG: string
  CLUSTER_API_URL: string
  CLUSTER_AUTH_TOKEN: string
  CLUSTER_CONTAINER_NAME: string
  PORTS: {
    host: string
    container: string
  }[]
  SLACK_WEBHOOK: string
  NETWORK_MODE: string
  [key: string]: string | Object[]
}

async function run(): Promise<void> {
  try {
    // const REPOSITORY = process.env.GITHUB_REPOSITORY || ''
    const REPOSITORY = 'anant-sharma/nginx'
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
    await pullImage(cAxios, config)
    core.debug('Image Pull Complete')

    // Remove Old Image
    await removeOldImage(cAxios, config).catch(() => {})
    core.debug('Remove Old Complete')

    // Create New Container
    await createContainer(cAxios, config)
    core.debug('Create New Container Complete')

    // Start New Container
    await startContainer(cAxios, config)
    core.debug('Start New Container Complete')

    return
  } catch (e) {
    return Promise.reject(e)
  }
}

async function pullImage(
  cAxios: AxiosInstance,
  config: IConfig
): Promise<AxiosResponse<INull>> {
  const fromImage = `${config.DOCKER_USER}/${config.DOCKER_IMAGE_NAME}`
  const tag = config.TAG

  core.debug(`Pulling Image ${fromImage}:${tag}`)

  return cAxios({
    method: 'post',
    url: '/images/create',
    params: {
      fromImage,
      tag
    }
  })
}

async function removeOldImage(
  cAxios: AxiosInstance,
  config: IConfig
): Promise<AxiosResponse<INull>> {
  core.debug(`Removing Image ${config.CLUSTER_CONTAINER_NAME}`)

  return cAxios({
    method: 'delete',
    url: `/containers/${config.CLUSTER_CONTAINER_NAME}`,
    params: {
      v: true,
      force: true
    },
    data: {}
  })
}

async function createContainer(
  cAxios: AxiosInstance,
  config: IConfig
): Promise<AxiosResponse<INull>> {
  const params = {
    name: config.CLUSTER_CONTAINER_NAME
  }

  const data = {
    Image: `${config.DOCKER_USER}/${config.DOCKER_IMAGE_NAME}:${config.TAG}`,
    ExposedPorts: config.PORTS.reduce(
      (result: {[key: string]: Object}, port) => {
        result[`${port.container}/tcp`] = {}
        return result
      },
      {}
    ),
    HostConfig: {
      PortBindings: config.PORTS.reduce(
        (result: {[key: string]: Object}, port) => {
          result[`${port.container}/tcp`] = [
            {
              HostPort: port.host
            }
          ]
          return result
        },
        {}
      ),
      PublishAllPorts: true,
      AutoRemove: true,
      NetworkMode: config.NETWORK_MODE || 'bridge'
    },
    name: config.CLUSTER_CONTAINER_NAME
  }

  core.debug(`Creating container with params ${JSON.stringify(params)}`)
  core.debug(`Creating container with data ${JSON.stringify(data)}`)

  return cAxios({
    method: 'post',
    url: `/containers/create`,
    params,
    data
  })
}

async function startContainer(
  cAxios: AxiosInstance,
  config: IConfig
): Promise<AxiosResponse<INull>> {
  core.debug(`Starting Container Image ${config.CLUSTER_CONTAINER_NAME}`)

  return cAxios({
    method: 'post',
    url: `/containers/${config.CLUSTER_CONTAINER_NAME}/start`,
    params: {},
    data: {}
  })
}

run()
