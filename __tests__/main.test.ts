import {IRetroArguments, tryCreateRetro} from '../src/retro'

const DefaultArgs: IRetroArguments = {
  repoToken: 'TEST',
  handles: ['hross', 'alepauly'],
  retroCadenceInWeeks: 1,
  retroDayOfWeek: 5,
  onlyLog: true
}

test('test retro creation', async () => {
  const args = DefaultArgs
  args.retroDayOfWeek = 4
  //await tryCreateRetro(DefaultArgs)
})
