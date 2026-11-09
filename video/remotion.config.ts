import { Config } from "@remotion/cli/config";

// Frames are PNG: the judges' pixel art never goes through JPEG on the way to the encoder.
Config.setVideoImageFormat("png");
Config.setCodec("h264");
Config.setCrf(12);
Config.setPixelFormat("yuv420p");
Config.setConcurrency(6);
