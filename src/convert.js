const fs = require('fs');
const path = require("path");
const shell = require("shelljs");
const _ = require("lodash");

// 音频格式
const audioSuffixList = ["mp3", "wav", "flac", "aac", "ogg", "m4a", "aiff"];


const getSetting = async function(dir, name, suffix, option, cropping) {
  const folder = "/data";
  const src = path.posix.join(folder, name);
  const exec = [
    `docker run --rm`,
    `-v ${dir}:${folder}`,
    'linuxserver/ffmpeg:latest',
    `-i ${src}`
  ];
  if (cropping) {
    if (option["t"]) {
      const value = Number(option["t"] || 4);
      if (value < 1) {
        option["t"] = 1;
      }
    }
    if (option["ss"]) {
      if (/^\d{1,}:\d{1,2}$/.test(option["ss"])) {
        option["ss"] = `${option["ss"]}:00`;
      } if (/^\d{1,}:\d{1,2}:\d{1,2}$/.test(option["ss"]) === false) {
        option["ss"] = "00:00:00";
      }
    }
    if (option["to"]) {
      if (/^\d{1,}:\d{1,2}$/.test(option["to"])) {
        option["to"] = `${option["to"]}:00`;
      } if (/^\d{1,}:\d{1,2}:\d{1,2}$/.test(option["to"]) === false) {
        option["to"] = "00:00:00";
      }
    }
    
    if (option.ss) {
      exec.push(`-map 0:a:0 -ss ${option.ss}`);
      if (option.to) {
        exec.push(`-to ${option.to}`);
      } else if (option.t){
        exec.push(`-t ${option.t}`);
      }
      exec.push('-c copy');
    }
    const newName = `${Date.now()}_${name}`;
    exec.push(path.posix.join(folder, newName));
    return { exec: exec.join(" "), name: newName };
  } else {
    if (option["q"]) {
      const value = Number(option["quality"] || 4);
      if (value > 9) {
        option["q"] = 9;
      }
      if (value < 1) {
        option["q"] = 1;
      }
    }
    // 转换插件
    switch(suffix) {
      case "mp3":
        exec.push("-codec:a libmp3lame");
        exec.push(`-q:a ${option.quality || 4}`);
        break;
      case "ogg":
        exec.push("-codec:a libvorbis");
        exec.push(`-q:a ${option.quality || 4}`);
        break;
      case "aac":
        exec.push("-codec:a aac");
        exec.push(`-q:a ${option.quality || 4}`);
        break;
      default:
        break;
    }
    const newName = `${Date.now()}_${path.basename(name, path.extname(name))}.${suffix}`;
    exec.push(path.posix.join(folder, newName));
    return { exec: exec.join(" "), name: newName };
  }

}


const convertData = async function(dir, name, suffix, option, cropping) {
  // 判断当前环境中是否安装 docker 服务
  if (shell.which("docker")) {
    const setting = await getSetting(dir, name, suffix, option, cropping);
    try {
      let exec;
      // 执行 ffmpeg 镜像
      if (audioSuffixList.includes(suffix)) {
        exec = setting.exec;
      }
      if (exec && exec.length > 0) {
        console.log("转换 = %s", exec);
        shell.exec(exec, { silent: true });
        const outputSrc = path.join(dir, setting.name)
        if (fs.statSync(outputSrc)) {
          return { src: outputSrc };
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
  return false
}



const main = async function(src, suffix, option) {
  const app = function(src, setting) {
    const dir = path.dirname(src);
    const name = path.basename(src);
    let cropping = false;
    if (setting && setting['ss']) {
      cropping = true;
    }
    return convertData(dir, name, (suffix || "mp3").toLocaleLowerCase(), setting, cropping);
  }
  try {
    if (fs.statSync(src)) {
      const data = await app(src, _.omit(option || {}, ['ss', 'to', 't']));
      // 判断是否需要对音视频进行裁剪
      if (option && option['ss']) {
        return app(data.src, option || {});
      }
      return data;
    }
  } catch (error) {
  }
  return false;
}

module.exports = main;
