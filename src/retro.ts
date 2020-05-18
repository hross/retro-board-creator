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

  // find the last retro
  const lastRetroOn: Date = await findLatestRetroDate(client)

  core.info(`Last retro created on: ${lastRetroOn}`)

  // should we create a retro or did it already get created?
  const diff = lastRetroOn.getMilliseconds() - new Date().getMilliseconds()
  const diffInDays = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (diffInDays > 1) {
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

  core.info(`Retro driver is: ${retroDate}`)

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
function whoIsNext(handles: string[], retroCadenceInWeeks: number = 1): string {
  // choose an arbitrary day to start with
  const firstWeek = new Date('01/01/2010')
  const today = new Date()
  const diff = today.getTime() - firstWeek.getTime()
  const daysSince = Math.floor(diff / (1000 * 60 * 60 * 24))
  const retrosSince = Math.floor(daysSince / (7 * retroCadenceInWeeks))
  const index = Math.ceil((retrosSince / 2) % handles.length)
  const nxt = handles[index]

  return nxt
}

// look at all of the repo projects and give back the last retro date
async function findLatestRetroDate(client: github.GitHub): Promise<Date> {
  const retroBodyStart = 'Retro on '
  const projects = await client.projects.listForRepo({
    owner: github.context.repo.owner,
    repo: github.context.repo.owner
  })

  // find all the projects with a retro format, parse the date and return the first date after sort
  const sorted = projects.data
    .filter(proj => proj.body.startsWith(retroBodyStart))
    .map(proj =>
      new Date(proj.body.replace(retroBodyStart, '')).getMilliseconds()
    )
    .sort()

  // return the latest or today's date
  return sorted.length > 0 ? new Date(sorted[0]) : new Date()
}

// calculate the next retro date given the starting week, day of the week the retro should occur, and how often the retro happens
function nextRetroDate(
  lastRetroDate: Date,
  retroDayOfWeek: number,
  retroCadenceInWeeks: number
): Date {
  // approximate the date of the next retro based on frequency
  const nextDate = new Date(
    lastRetroDate.getDate() + retroCadenceInWeeks * 7
  )
  // make sure it's on the right day, in case the day of week changed
  nextDate.setDate(
    nextDate.getDate() +
      ((7 + retroDayOfWeek - nextDate.getDay()) % 7)
  )

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
    repo: github.context.repo.owner,
    name: `Retrospective - Week of ${readableDate}`,
    body: `Retro on ${retroDate}`
  })

  if (!project) {
    return ''
  }

  const columnNames = ['Action items!', 'Shoutouts', 'Could be better', 'Good']
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
    repo: github.context.repo.owner,
    title: `The next retro driver is @${retroDriver}`,
    body: `Hey @${retroDriver} please remind everyone to fill out the retrospective board at ${projectUrl}`
  })

  await client.issues.addAssignees({
    owner: github.context.repo.owner,
    repo: github.context.repo.owner,
    issue_number: issue.data.number,
    assignees: [retroDriver]
  })

  return issue.data.number
}
