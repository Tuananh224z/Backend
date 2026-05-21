const express = require('express');
const publicRouter = require('./publicRoutes');
const protectedRouter = require('./protectedRoutes');
const adminRouter = require('./adminRoutes');

/**
 * Initializes all API route groups with the /api base path.
 * 
 * @param {express.Application} app - The Express application instance.
 */
const initAPIRoutes = (app) => {
  app.use('/api', publicRouter);
  app.use('/api', protectedRouter);
  app.use('/api', adminRouter);
};

module.exports = initAPIRoutes;
