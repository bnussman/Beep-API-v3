import { Controller, Get, Route, Tags } from "tsoa";
import * as fs from "fs";

@Tags("Docs")
@Route("docs")
export class DocsController extends Controller {
    @Get()
    public getDocs(): any {
        this.setStatus(200);
        const data = fs.readFileSync('build/swagger.json');
        return JSON.parse(data.toString());
    }
}
