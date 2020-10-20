import { APIStatus, APIResponse } from "../utils/Error";
import { Controller, Get, Route, Tags } from "tsoa";

@Tags("Healthcheck")
@Route("healthcheck")
export class HealthcheckController extends Controller {
    @Get()
    public healthcheck(): APIResponse {
        this.setStatus(200);
        return new APIResponse(APIStatus.Success, "ok");
    }
}
