function createReportController(service) {
  return {
    summary: async (req, res, next) => {
      try {
        res.json(await service.getSummary());
      } catch (error) {
        next(error);
      }
    },
    revenue: async (req, res, next) => {
      try {
        res.json(await service.getRevenue(req.query));
      } catch (error) {
        next(error);
      }
    },
    exportData: async (req, res, next) => {
      try {
        res.json(await service.getExportData(req.query));
      } catch (error) {
        next(error);
      }
    },
  };
}

module.exports = {
  createReportController,
};
