import JqlDataPage from '../components/JqlDataPage'

export default function StoriesPage() {
  return (
    <JqlDataPage
      pageId="stories"
      title="User Stories"
      subtitle="User stories from OMPE"
      defaultJql='project = OMPE AND issuetype = Story AND status != Done ORDER BY cf[13210] ASC, priority ASC'
      extraColumns={['statusUpdate', 'staleness']}
    />
  )
}
