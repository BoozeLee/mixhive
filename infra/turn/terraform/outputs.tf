output "server_id" {
  description = "Hetzner server ID used by the rescue bootstrap."
  value       = hcloud_server.turn.id
}

output "ssh_key_id" {
  description = "Hetzner SSH key ID injected into Rescue."
  value       = hcloud_ssh_key.admin.id
}

output "server_ipv4" {
  description = "Public IPv4 for the unproxied turn.mixhive.app A record."
  value       = hcloud_server.turn.ipv4_address
}

output "dns_record" {
  description = "Manual DNS checkpoint."
  value       = "turn.mixhive.app A ${hcloud_server.turn.ipv4_address} (DNS-only/unproxied, TTL 300)"
}

output "ssh_command" {
  description = "Arch administrator SSH command after bootstrap."
  value       = "ssh turnadmin@${hcloud_server.turn.ipv4_address}"
}
