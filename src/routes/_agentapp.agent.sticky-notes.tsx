import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_agentapp/agent/sticky-notes')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_agentapp/agent/sticky-notes"!</div>
}
