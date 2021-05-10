# asana-actions1

add this to your `.github/workflows/pull-request.yml`

```
name: Pull Request
on:
  pull_request:
    types: [ opened, edited ]
jobs:
  asana:
    runs-on: ubuntu-latest
    steps:
    - name: Asana Github Pull Request Link
      uses: ExodusMovement/asana-actions@1.0.18
      with:
        token: ${{ secrets.ASANA_TOKEN }}
        workspace: ${{ secrets.ASANA_WORKSPACE_ID }}
```
