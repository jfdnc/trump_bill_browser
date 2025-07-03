#!/usr/bin/env node

/**
 * MCP Server Launcher
 * Launches the MCP server for legislative bill queries
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DocumentMCPServer = require('./mcpServer');
const documentParser = require('./services/documentParser');
const logger = require('./utils/logger');

async function main() {
  try {
    logger.info('Starting MCP server launcher...');
    
    // Initialize document parser
    logger.info('Initializing document parser...');
    await documentParser.init();
    
    // Create and run MCP server
    logger.info('Creating MCP server...');
    const mcpServer = new DocumentMCPServer();
    
    logger.info('Starting MCP server...');
    await mcpServer.run();
    
    logger.info('MCP server is running and ready for connections');
    
  } catch (error) {
    logger.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down MCP server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down MCP server...');
  process.exit(0);
});

// Run the server
main().catch(error => {
  logger.error('Unhandled error in MCP server:', error);
  process.exit(1);
});