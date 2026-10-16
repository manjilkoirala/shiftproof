import { Data, emptyData, validateData } from "./domain";
export async function readData(): Promise<Data> {
  const raw = localStorage.getItem("shiftproof-v1");
  return raw ? validateData(JSON.parse(raw)) : emptyData;
}
export async function writeData(data: Data) {
  validateData(data);
  localStorage.setItem("shiftproof-v1", JSON.stringify(data));
}
