variable "server_name" {
  description = "Hetzner Cloud server and hostname prefix."
  type        = string
  default     = "mixhive-turn-01"
}

variable "server_type" {
  description = "Hetzner x86 shared-vCPU server type."
  type        = string
  default     = "cx23"
}

variable "location" {
  description = "Hetzner Cloud location."
  type        = string
  default     = "nbg1"
}

variable "bootstrap_image" {
  description = "Temporary Hetzner image used before the automated Arch rescue install."
  type        = string
  default     = "ubuntu-24.04"
}

variable "ssh_public_key_path" {
  description = "Administrator SSH public key path."
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}
