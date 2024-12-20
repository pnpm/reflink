/* tslint:disable */
/* eslint-disable */

/* auto-generated by NAPI-RS */

export declare function reflinkFile(src: string, dst: string): Promise<number | ReflinkError>
export declare function reflinkFileSync(src: string, dst: string): number | ReflinkError
/** Contains all properties to construct an actual error. */
export class ReflinkError {
  message: string
  path: string
  dest: string
  code?: string
  errno?: number
  constructor(message: string, path: string, dest: string, code?: string, errno?: number)
}
