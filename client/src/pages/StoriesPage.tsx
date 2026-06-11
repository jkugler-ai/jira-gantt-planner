import JqlDataPage from '../components/JqlDataPage'

export default function StoriesPage() {
  return (
    <JqlDataPage
      pageId="stories"
      title="User Stories"
      subtitle="User stories from OMPE"
      defaultJql='project = OMPE AND issuetype = Story AND status != Done AND created >= -60d ORDER BY cf[13210] ASC, priority ASC'
      extraColumns={['statusUpdate', 'staleness']}
    />
  )
}
