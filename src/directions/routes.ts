import { Controller, Tags, Route, Security, Get, Path, Example, Response } from 'tsoa';
import { APIStatus, APIResponse } from "../utils/Error";
import { DirectionsResponse } from './directions';
import fetch from 'node-fetch';

@Tags("Directions")
@Route("directions")
export class DirectionsController extends Controller {

    /**
     * Use Google Maps Directions API to get an ETA value from point a to b
     * @param start the start location
     * @param end the end location
     * @returns {DirectionsResponse | APIResponse}
     */
    @Example<DirectionsResponse>({
        status: APIStatus.Success,
        eta: "7 minutes"
    })
    @Response<APIResponse>(500, "Server Error", {
        status: APIStatus.Error,
        message: "Unable to get ETA"
    })
    @Security("token")
    @Get("{start}/{end}")
    public async getDirections(@Path() start: string, @Path() end: string): Promise<DirectionsResponse | APIResponse> {
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
                return new APIResponse(APIStatus.Error, data.error_message);
            }
        }
        catch (error) {
            this.setStatus(500);
            return new APIResponse(APIStatus.Error, error);
        }
    }
}
