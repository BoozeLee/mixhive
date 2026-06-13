locals {
  labels = {
    app     = "mixhive"
    role    = "turn-relay"
    managed = "terraform"
  }
}

resource "hcloud_ssh_key" "admin" {
  name       = "${var.server_name}-admin"
  public_key = file(pathexpand(var.ssh_public_key_path))
  labels     = local.labels
}

resource "hcloud_firewall" "turn" {
  name   = "${var.server_name}-firewall"
  labels = local.labels

  rule {
    direction = "in"
    protocol  = "tcp"
    port      = "22"
    source_ips = [
      "0.0.0.0/0",
      "::/0",
    ]
    description = "SSH key-only administration"
  }

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "80"
    source_ips  = ["0.0.0.0/0"]
    description = "Let's Encrypt HTTP-01"
  }

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "3478"
    source_ips  = ["0.0.0.0/0"]
    description = "TURN TCP"
  }

  rule {
    direction   = "in"
    protocol    = "udp"
    port        = "3478"
    source_ips  = ["0.0.0.0/0"]
    description = "TURN UDP"
  }

  rule {
    direction   = "in"
    protocol    = "tcp"
    port        = "5349"
    source_ips  = ["0.0.0.0/0"]
    description = "TURN TLS"
  }

  rule {
    direction   = "in"
    protocol    = "udp"
    port        = "49160-49200"
    source_ips  = ["0.0.0.0/0"]
    description = "TURN UDP relay allocation range"
  }
}

resource "hcloud_server" "turn" {
  name        = var.server_name
  image       = var.bootstrap_image
  server_type = var.server_type
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.admin.id]
  firewall_ids = [
    hcloud_firewall.turn.id,
  ]
  backups            = false
  delete_protection  = true
  rebuild_protection = true
  labels             = local.labels

  public_net {
    ipv4_enabled = true
    ipv6_enabled = false
  }
}
