# chip-config-fetch action

This action authenticates workflow and fetch deployment config

## Inputs

### `REPOSITORY`

**Required** The name of repository for which config needs to be fetched. For instance `anant-sharma/chip-config-fetch` (env.GITHUB_REPOSITORY)

### `ACCESS_TOKEN`

**Required** Github Personal Access Token to authenticate service.

## Outputs

### `config`

Repository config

## Example usage

```
uses: actions/chip-config-fetch@v1
id: configfetch
with:
  REPOSITORY: ${{ env.GITHUB_REPOSITORY }}
  ACCESS_TOKEN: ${{ secrets.ACCESS_TOKEN }}
```

To use config value at later step

```
steps.configfetch.outputs.<config_variable>
```
