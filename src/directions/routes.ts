import { Controller, Tags, Route, Security, Get, Path } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import fetch from 'node-fetch';

@Tags("Directions")
@Route("directions")
export class DirectionsController extends Controller {

    @Security("token")
    @Get("{start}/{end}")
    public async getDirections(@Path() start: string, @Path() end: string): Promise<any | APIResponse> {
        try {
            const result = await fetch('https://maps.googleapis.com/maps/api/directions/json?origin=' + start + '&destination=' + end + '&key=AIzaSyBgabJrpu7-ELWiUIKJlpBz2mL6GYjwCVI');
            const data = await result.json();

            this.setStatus(result.status);

            if (result.ok) {
                return {
                    status: APIStatus.Success,
                    eta: data.routes[0].legs[0].duration.text
                };
            }
            else {
                return {
                    status: APIStatus.Error,
                    message: data.error_message
                };
            }
        }
        catch (error) {
            this.setStatus(500);
            return {
                status: APIStatus.Error,
                message: error
            }
        }
    }
}
