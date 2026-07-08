import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import repositoriesRouter from "./repositories";
import pullRequestsRouter from "./pull_requests";
import reviewsRouter from "./reviews";
import analyticsRouter from "./analytics";
import codeExplainRouter from "./code_explain";
import webhooksRouter from "./webhooks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(repositoriesRouter);
router.use(pullRequestsRouter);
router.use(reviewsRouter);
router.use(analyticsRouter);
router.use(codeExplainRouter);
router.use(webhooksRouter);

export default router;
