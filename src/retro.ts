import * as core from '@actions/core'
import * as github from '@actions/github'

export interface IRetroArguments {
  repoToken: string
  handles: string[]
  retroCadenceInWeeks: number
  retroDayOfWeek: number
  onlyLog: boolean
}

export async function tryCreateRetro(args: IRetroArguments): Promise<void> {
  const client = new github.GitHub(args.repoToken)

  core.info('Looking for latest retro date...')

  // find the last retro
  const lastRetroOn: Date = await findLatestRetroDate(client)

  core.info(`Last retro created on: ${lastRetroOn}`)

  // should we create a retro or did it already get created?
  const diff = lastRetroOn.getTime() - new Date().getTime()
  const diffInDays = diff / (1000 * 60 * 60 * 24)

  core.info(`Retro day difference is: ${diffInDays}`)
  if (diffInDays > -1) {
    core.info(`Retro hasn't happened yet, so not going to create a new one.`)
    return
  }

  // calculate the next retro date
  const retroDate: Date = nextRetroDate(
    lastRetroOn,
    args.retroDayOfWeek,
    args.retroCadenceInWeeks
  )

  core.info(`Next retro date calculated as: ${retroDate}`)

  // who is driving the retro?
  const nextRetroDriver = whoIsNext(args.handles, args.retroCadenceInWeeks)

  core.info(`Retro driver is: ${nextRetroDriver}`)

  if (!args.onlyLog) {
    // create the project board
    const projectUrl = await createBoard(client, retroDate)

    // create the issue
    await createTrackingIssue(client, projectUrl, nextRetroDriver)
  } else {
    core.info(
      `Skipping project/issue creation because we are running in log mode only.`
    )
  }
}

// figure who is running the next retro based on the list
function whoIsNext(handles: string[], retroCadenceInWeeks: number): string {
  // choose an arbitrary day to start with
  const firstWeek = new Date('01/01/2010')
  const today = new Date()
  const diff = today.getTime() - firstWeek.getTime()
  const daysSince = Math.floor(diff / (1000 * 60 * 60 * 24))
  core.info(`Days since: ${daysSince}`)
  const retrosSince = Math.floor(daysSince / (7 * retroCadenceInWeeks))
  core.info(`Retros since: ${retrosSince}`)
  core.info(`List of handles length: ${handles.length}`)
  const index = Math.floor(retrosSince % handles.length)
  core.info(`Handle index: ${index}`)
  const nxt = handles[index]

  return nxt
}

// look at all of the repo projects and give back the last retro date
async function findLatestRetroDate(client: github.GitHub): Promise<Date> {
  const retroBodyStart = 'Retro on '

  const projects = await client.projects.listForRepo({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo
  })

  core.info(`Found ${projects.data.length} for this repo`)

  // find all the projects with a retro format, parse the date and return the first date after sort
  const sorted = projects.data
    .filter(proj => proj.body.startsWith(retroBodyStart))
    .map(proj => Date.parse(proj.body.replace(retroBodyStart, '')))
    .sort()
    .reverse()

  core.info(`Found ${sorted.length} retro projects for this repo`)

  const defaultRetroDate = new Date()
  defaultRetroDate.setDate(defaultRetroDate.getDate() - 7) // 1 week in the past to ensure we create a new retro

  // return the latest or today's date
  return sorted.length > 0 ? new Date(sorted[0]) : defaultRetroDate
}

// calculate the next retro date given the starting week, day of the week the retro should occur, and how often the retro happens
function nextRetroDate(
  lastRetroDate: Date,
  retroDayOfWeek: number,
  retroCadenceInWeeks: number
): Date {
  // approximate the date of the next retro based on frequency
  let nextDate = new Date(lastRetroDate)
  nextDate.setDate(nextDate.getDate() + retroCadenceInWeeks * 7)

  if (nextDate < new Date()) {
    core.info(
      'Next calculated retro is in the past, so using today to start retros'
    )
    nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + (retroCadenceInWeeks - 1) * 7)
  }

  core.info(`Next approximate retro date is ${nextDate}`)

  const daysToAdd = (7 + retroDayOfWeek - nextDate.getDay()) % 7

  core.info(`Adding: ${daysToAdd} to get to the next retro day of the week`)

  // make sure it's on the right day, in case the day of week changed
  nextDate.setDate(nextDate.getDate() + daysToAdd)

  return nextDate
}

// create the retro board and return the URL
async function createBoard(
  client: github.GitHub,
  retroDate: Date
): Promise<string> {
  const readableDate = retroDate.toLocaleDateString('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })

  const project = await client.projects.createForRepo({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    name: `Retrospective - Week of ${readableDate}`,
    body: `Retro on ${retroDate}`
  })

  if (!project) {
    return ''
  }

  const columnNames = ['Action items!', 'Shoutouts', 'Could be better', 'Good', 'Action items from last retro']
  for (const name of columnNames) {
    client.projects.createColumn({
      project_id: project.data.id,
      name
    })
  }

  return project.data.html_url
}

// create a tracking issue for the retro
async function createTrackingIssue(
  client: github.GitHub,
  projectUrl: string,
  retroDriver: string
): Promise<number> {
  const issue = await client.issues.create({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    title: `The next retro driver is @${retroDriver}`,
    body: `Hey @${retroDriver} please remind everyone to fill out the retrospective board at ${projectUrl}`
  })

  await client.issues.addAssignees({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: issue.data.number,
    assignees: [retroDriver]
  })

  return issue.data.number
}
