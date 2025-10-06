#!/bin/bash

# Model Configuration Script for Claim Validator
# This script helps you quickly switch between different model configurations

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to backup current .env
backup_env() {
    if [ -f "$ENV_FILE" ]; then
        cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        print_status "Backed up current .env file"
    fi
}

# Function to apply configuration
apply_config() {
    local config_name="$1"
    local config_file="$SCRIPT_DIR/configs/$config_name.env"
    
    if [ ! -f "$config_file" ]; then
        print_error "Configuration file not found: $config_file"
        exit 1
    fi
    
    backup_env
    
    # Remove existing agent model configurations
    sed -i.bak '/^# Agent Model Configuration/,/^# =============================================================================$/d' "$ENV_FILE"
    
    # Append new configuration
    cat "$config_file" >> "$ENV_FILE"
    
    print_status "Applied configuration: $config_name"
    print_warning "Please restart your containers to apply the new model configuration"
}

# Function to show current configuration
show_current() {
    print_status "Current Model Configuration:"
    echo ""
    
    if [ -f "$ENV_FILE" ]; then
        echo -e "${BLUE}Sanity Check Agent:${NC}"
        grep "^SANITY_CHECK_MODEL=" "$ENV_FILE" || echo "  Using default (gpt-4o-mini)"
        grep "^SANITY_CHECK_TEMPERATURE=" "$ENV_FILE" || echo "  Using default (0.1)"
        grep "^SANITY_CHECK_MAX_TOKENS=" "$ENV_FILE" || echo "  Using default (3000)"
        echo ""
        
        echo -e "${BLUE}Planner Agent:${NC}"
        grep "^PLANNER_MODEL=" "$ENV_FILE" || echo "  Using BASE_AGENT_MODEL"
        grep "^BASE_AGENT_MODEL=" "$ENV_FILE" || echo "  Using default (gpt-4o-mini)"
        echo ""
        
        echo -e "${BLUE}Research Agent:${NC}"
        grep "^RESEARCH_CLAUDE_MODEL=" "$ENV_FILE" || echo "  Using CLAUDE_MODEL"
        grep "^RESEARCH_GPT5_MODEL=" "$ENV_FILE" || echo "  Using GPT5_MODEL"
        grep "^RESEARCH_DEEPSEEK_MODEL=" "$ENV_FILE" || echo "  Using DEEPSEEK_MODEL"
        echo ""
        
        echo -e "${BLUE}Evaluator Agent:${NC}"
        grep "^EVALUATOR_MODEL=" "$ENV_FILE" || echo "  Using BASE_AGENT_MODEL"
        echo ""
    else
        print_error ".env file not found"
    fi
}

# Function to list available configurations
list_configs() {
    print_status "Available Model Configurations:"
    echo ""
    
    if [ -d "$SCRIPT_DIR/configs" ]; then
        for config in "$SCRIPT_DIR/configs"/*.env; do
            if [ -f "$config" ]; then
                config_name=$(basename "$config" .env)
                echo "  - $config_name"
            fi
        done
    else
        print_warning "No configuration files found in $SCRIPT_DIR/configs"
    fi
}

# Main script logic
case "$1" in
    "apply")
        if [ -z "$2" ]; then
            print_error "Please specify a configuration name"
            echo "Usage: $0 apply <config-name>"
            echo "Run '$0 list' to see available configurations"
            exit 1
        fi
        apply_config "$2"
        ;;
    "show"|"current")
        show_current
        ;;
    "list")
        list_configs
        ;;
    "help"|"-h"|"--help")
        echo "Model Configuration Script for Claim Validator"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  apply <config-name>  Apply a specific model configuration"
        echo "  show                 Show current model configuration"
        echo "  list                 List available model configurations"
        echo "  help                 Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 apply fast-and-cheap"
        echo "  $0 apply high-quality"
        echo "  $0 show"
        echo "  $0 list"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac
