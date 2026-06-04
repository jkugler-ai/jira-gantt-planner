import JqlDataPage from '../components/JqlDataPage'

export default function BugsPage() {
  return (
    <JqlDataPage
      pageId="bugs"
      title="Bugs"
      subtitle="Track open bugs and defects"
      defaultJql='project = OMPE AND issuetype = Bug AND statusCategory != Done AND "Development Team" in ("Storage Infrastructure APIs", "USD Storage API", "Caching Services", Portal, ovstorage, ovpackage) ORDER BY priority ASC, created DESC'
      extraColumns={['priority', 'fixVersion', 'created', 'nvbugs', 'reporter', 'staleness']}
      showStatusFilter={true}
      hideProductManagerFilter={true}
      highlightUntriaged={true}
      flagStaleMonths={1}
      hideStartDate={true}
      hideType={true}
    />
  )
}
