import JqlDataPage from '../components/JqlDataPage'

export default function SprintGoalsPage() {
  return (
    <JqlDataPage
      pageId="sprint-goals"
      title="Sprint Goals"
      subtitle="High-level sprint objectives and progress"
      defaultJql='project = OMPE AND issuetype = "Sprint Goal" AND status != Done ORDER BY cf[13210] ASC, priority ASC'
    />
  )
}
