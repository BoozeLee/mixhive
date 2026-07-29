#!/usr/bin/env ruby
# frozen_string_literal: true

# MixHive scheduler — the always-on replacement for Vercel Hobby crons.
#
# Vercel Hobby runs at most ONE cron/day, so the hourly/extra jobs in vercel.json
# (nft-sync, push-sender, notification-prioritizer, …) effectively never fire. This
# pure-stdlib Ruby daemon fires each one on its real interval by calling the existing
# Vercel cron endpoints with CRON_SECRET. No gems → runs anywhere, container-friendly.
#
# Ruby's role in the Active Worker Tier (see docs/INFRA_INTEGRATION_REPORT.md §2.3):
# reliable scheduling/orchestration. Kept deliberately small and dependency-free.

require 'net/http'
require 'uri'
require 'json'
require 'logger'

LOG = Logger.new($stdout)
LOG.formatter = proc { |sev, time, _p, msg| "#{time.utc.iso8601} #{sev} #{msg}\n" }

BASE = ENV['APP_BASE_URL'] || 'https://mixhive.vercel.app'
SECRET = ENV['CRON_SECRET'] or abort('CRON_SECRET is required')

# job => interval in seconds. Mirrors vercel.json intent but actually fires.
JOBS = {
  '/api/cron/nft-sync'                 => Integer(ENV.fetch('IV_NFT_SYNC', 3600)),     # hourly
  '/api/cron/push-sender'              => Integer(ENV.fetch('IV_PUSH', 300)),          # every 5m
  '/api/cron/notification-prioritizer' => Integer(ENV.fetch('IV_NOTIF', 3600)),        # hourly
  '/api/cron/strategic-agents'         => Integer(ENV.fetch('IV_STRATEGIC', 86_400)),  # daily
  '/api/cron/embed-refresh'            => Integer(ENV.fetch('IV_EMBED', 86_400)),      # daily
  '/api/cron/payouts-auto-release'     => Integer(ENV.fetch('IV_PAYOUTS', 21_600)),    # 6h
  '/api/cron/account-delete'           => Integer(ENV.fetch('IV_ACCOUNT_DELETE', 86_400)), # daily
  '/api/cron/publish-scheduled'        => Integer(ENV.fetch('IV_PUBLISH_SCHEDULED', 600)),  # 10m
  '/api/cleanup'                       => Integer(ENV.fetch('IV_CLEANUP', 86_400)),    # daily
  '/api/analytics/daily'               => Integer(ENV.fetch('IV_ANALYTICS', 86_400)),   # daily
  '/api/cron/monthly-recap'            => Integer(ENV.fetch('IV_MONTHLY_RECAP', 2_592_000)) # ~30d
}.freeze

POST_JOBS = Set.new([
  '/api/cron/notification-prioritizer',
  '/api/cron/strategic-agents'
]).freeze

def fire(path)
  uri = URI.join(BASE, path)
  req = if POST_JOBS.include?(path)
          Net::HTTP::Post.new(uri)
        else
          Net::HTTP::Get.new(uri)
        end
  req['Authorization'] = "Bearer #{SECRET}"
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https', open_timeout: 10, read_timeout: 120) do |http|
    http.request(req)
  end
  LOG.info("fired #{path} -> #{res.code}")
rescue StandardError => e
  LOG.error("fire #{path} failed: #{e.class}: #{e.message}")
end

running = true
%w[INT TERM].each { |s| Signal.trap(s) { running = false } }

# Stagger first runs so we don't hit everything at boot; track next-due per job.
now = Time.now
next_due = JOBS.transform_values.with_index { |iv, i| now + (i * 7) + 5 }

LOG.info("mixhive scheduler up — base=#{BASE} jobs=#{JOBS.size}")
while running
  t = Time.now
  JOBS.each do |path, interval|
    next if t < next_due[path]

    fire(path)
    next_due[path] = t + interval
  end
  sleep 1
end
LOG.info('scheduler shutting down')
