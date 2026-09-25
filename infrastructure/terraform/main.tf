terraform {
  required_version = ">= 1.6.0"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "name" {
  type    = string
  default = "codepilot"
}

# This stack is a placeholder. It does not create a VPC, database, or cluster,
# and it does not contain secrets. Local development uses Docker Compose.
output "name" {
  value = var.name
}

output "region" {
  value = var.aws_region
}
