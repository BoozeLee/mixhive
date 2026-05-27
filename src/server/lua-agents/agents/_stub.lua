-- Stub agent — returns ok with no suggestions until a real implementation is added.
function run(ctx)
  mh_log("stub agent run", ctx.agent_id)
  return { status = "ok", suggestions = {}, tasks = {}, notifications = {} }
end
