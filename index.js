const core = require('@actions/core')
const github = require('@actions/github')
const utils = require('./utils')

const ACTION_CLOSE_PREFIX = "CLOSE"
const ACTION_MOVE_TO_SECTION_PREFIX = "MOVE_TO_SECTION"
const run = async () => {
  try {
    const github_token = core.getInput('github_token')
    const asana_token = core.getInput('asana_token')
    const workspace = core.getInput('workspace')
    const commentPrefix = core.getInput('comment_prefix') || 'Linked Asana: '
    const on_open_action = core.getInput('on_open_action')
    const on_merge_action = core.getInput('on_merge_action') || ACTION_CLOSE_PREFIX
    const isIssue = !!github.context.payload.issue
    const pr = github.context.payload.pull_request || github.context.payload.issue
    const action = github.context.payload.action
    let tasks

    if (!asana_token) {
      throw ({ message: 'ASANA_TOKEN not set' })
    }

    core.info(`Running action for ${isIssue ? 'issue' : 'PR'} #${pr.number}: ${pr.title}`)

    const lookupTasks = async () => {
      if (!shortidList || !shortidList.length) {
        core.info('No matching asana shorts id in: ' + pr.title)
        return
      } else {
        core.info('Searching for short id: ' + shortidList.join(','))
      }

      const tasks = await utils.getMatchingAsanaTasks(asana_token, workspace, shortidList)

      if (tasks && tasks.length) core.info('Got matching task: ' + JSON.stringify(tasks))
      else core.error('Did not find matching task')

      return tasks
    }

    const isCloseAction = (onAction) => {
      return onAction.startsWith(ACTION_CLOSE_PREFIX)
    }

    const isMoveAction = (onAction) => {
      return onAction.startsWith(ACTION_MOVE_TO_SECTION_PREFIX)
    }

    const getSectionFromAction = (onAction) => {
      return onAction
        .substring(ACTION_MOVE_TO_SECTION_PREFIX.length, onAction.length)
        .trim()
    }

    const doAction = async (tasks, onAction) => {
      if (isCloseAction(onAction)) {
        await utils.completeAsanaTasks(asana_token, tasks)
        core.info('Marked linked Asana task(s) as completed')
      }
      if (isMoveAction(onAction)) {
        const sectionId = getSectionFromAction(onAction)
        core.info('Moving Asana task(s) to section ' + sectionId)
        await utils.moveAsanaTasksToSection(asana_token, tasks, sectionId)
        core.info('Moved linked Asana task(s) to section ' + sectionId)
      }
    }

    const shortidList = utils.getAsanaShortIds(pr.title)

    if (action === 'opened' || action === 'edited') {
      if (pr.body.indexOf(commentPrefix) === -1) {
        core.info('lets fetch the tasks')

        tasks = await lookupTasks()
        if (!tasks || !tasks.length) return

        const response = await utils.updatePRBody(workspace, github_token, tasks, pr, commentPrefix, isIssue)

        if (response.status !== 200) {
          core.error('There was an issue while trying to update the pull-request/issue.')
        } else {
          // only when opened and asana link not found so we can have the PR link (comment) as soon as the first PR action
          await utils.addGithubPrToAsanaTask(asana_token, tasks, pr.title, pr.url)
          core.info('Modified PR body with asana link')
        }

      } else {
        core.info('Skipping, already found asana link on PR')
      }

      if (action === 'opened' && on_open_action) {
        if (tasks && tasks.length) await doAction(tasks, on_open_action)
      }

    } else if (action === 'closed' && (isIssue ? true : pr.merged)) {
      tasks = await lookupTasks()
      if (!tasks || !tasks.length) return

      if (on_merge_action) {
        await doAction(tasks, on_merge_action)
      }
    }
  } catch (err) {
    core.error(err.message)
  }
}

run()