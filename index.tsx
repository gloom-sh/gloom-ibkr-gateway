/**
 * The Bun entry: the terminal, and the desktop's Bun process.
 *
 * This is the only place that names the socket implementation. The service
 * module every pane imports never does, so the browser entry can share it
 * without dragging `@stoqey/ib` into a bundle that cannot open a socket.
 */
import { setNativeIbkrGatewayModuleLoader } from "./gateway/service";
import { ibkrGatewayPlugin } from "./plugin";

setNativeIbkrGatewayModuleLoader(() => import("./gateway/service/native"));

export { ibkrGatewayPlugin };
export default ibkrGatewayPlugin;
