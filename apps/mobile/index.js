import { Buffer } from "buffer";
import process from "process";

global.Buffer = Buffer;
global.process = process;

import "expo-router/entry";
