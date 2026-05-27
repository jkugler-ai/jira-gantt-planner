import JqlDataPage from '../components/JqlDataPage'

export default function BugsPage() {
  return (
    <JqlDataPage
      pageId="bugs"
      title="Bugs"
      subtitle="Track open bugs and defects"
      defaultJql='project = OMPE AND issuetype = Bug AND statusCategory != Done ORDER BY priority ASC, created DESC'
      extraColumns={['priority', 'fixVersion', 'created', 'nvbugs', 'reporter']}
      showStatusFilter={true}
      hideProductManagerFilter={true}
      highlightUntriaged={true}
      flagStaleMonths={1}
    />
  )
}
