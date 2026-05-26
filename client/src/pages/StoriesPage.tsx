import JqlDataPage from '../components/JqlDataPage'

export default function StoriesPage() {
  return (
    <JqlDataPage
      pageId="stories"
      title="User Stories"
      subtitle="Feeds Gantt, Calendar, Dependencies & Email views"
      defaultJql='project = OMPE AND issuetype = Story AND status != Done ORDER BY cf[13210] ASC, priority ASC'
      feedsDownstream={true}
    />
  )
}
