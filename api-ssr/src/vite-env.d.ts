declare module "*.css";
declare module "@askrjs/charts/styles";

declare module "*?worker" {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}
