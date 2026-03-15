const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const printJobsController = require("../controllers/print-jobs.controller");

router.get("/", asyncHandler(printJobsController.listJobs));
router.get("/:id/print", asyncHandler(printJobsController.getJobPrintView));
router.get("/:id", asyncHandler(printJobsController.getJobById));
router.post("/", asyncHandler(printJobsController.createJob));
router.post("/:id/retry", asyncHandler(printJobsController.retryJob));

module.exports = router;
