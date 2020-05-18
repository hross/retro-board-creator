import * as core from '@actions/core'

import {IRetroArguments, tryCreateRetro} from './retro'

async function run(): Promise<void> {
  try {
    const args: IRetroArguments = {
      repoToken: core.getInput('repo-token', {required: true}),
      handles: [], //core.getInput('repo-token', {required: true}),
      retroCadenceInWeeks: parseInt(core.getInput('retro-cadence-weeks')) ?? 1,
      retroDayOfWeek: parseInt(core.getInput('retro-day-of-week')) ?? 0,
      onlyLog: core.getInput('only-log') === 'true'
    }

    await tryCreateRetro(args)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
