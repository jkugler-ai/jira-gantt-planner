import JqlDataPage from '../components/JqlDataPage'

export default function ReleasesPage() {
  return (
    <JqlDataPage
      pageId="releases"
      title="Releases"
      subtitle="Track release milestones and timelines"
      defaultJql='project = OMPE AND issuetype = Release AND status != Done ORDER BY duedate ASC'
    />
  )
}
