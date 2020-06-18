# chip-config-fetch action

This action authenticates workflow and fetch deployment config

## Inputs

### `access_token`

**Required** Github Personal Access Token to authenticate service.

### `deploy`

**Required** "1" If deployment is required. Default 0.

## Outputs

### `config`

Repository config

## Example usage

```
uses: anant-sharma/chip-config-fetch@v1.2
id: configfetch
with:
  ACCESS_TOKEN: ${{ secrets.ACCESS_TOKEN }}
```

To use config value at later step

```
steps.configfetch.outputs.<config_variable>
```
