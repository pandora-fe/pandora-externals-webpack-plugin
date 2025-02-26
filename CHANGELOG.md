标签：
<font color=green>新增</font>
<font color=orange>修改</font>
<font color=blue>增强</font>
<font color=red>修复</font>
<font color=red><strong>删除</strong></font>

# 3.6.0
1. <font color=green>新增</font> `core-js` 路径配置
2. <font color=blue>增强</font> 支持 `babel.config.js` 导出函数

# 3.5.3
1. <font color=red>修复</font> `css` 文件没有添加 `integrity` 属性

# 3.5.2
1. <font color=red>修复</font> `css` 文件没有添加 `integrity` 属性

# 3.5.1
1. <font color=red>修复</font> 暗黑模式 `integrity` 属性值不对

# 3.5.0
1. <font color=green>新增</font> `script` 添加 `integrity` 属性，解决应用安全问题：SRI(Subresource Integrity) 的检查

# 3.4.0
1. <font color=red><strong>删除</strong></font> `pinyin-pro` 资源地址，已改为使用 `localeCompare` 排序


# 3.3.0
1. <font color=green>新增</font> `pinyin-pro` 资源地址


# 3.2.0
1. <font color=orange>修改</font> 组件库文件引用移除引用未压缩文件，只添加引用压缩后文件


# 3.1.0
1. <font color=green>新增</font> `react-router`和`react-router-dom`路径配置


# 3.0.3
1. <font color=red>修复</font> `@babel/polyfill`添加从下列包中查找安装版本号
```
babel-config-pandora
babel-config-pandora-typescript
```


# 3.0.2
1. <font color=red>修复</font> `babel.config.js`extends`babel-config-pandora`或`babel-config-pandora-typescript`时，认为使用了`@babel/plugin-transform-modules-commonjs`


# 3.0.1
1. <font color=red>修复</font> `webpack5`时判断`entry`值类型不正确


# 3.0.0
1. <font color=orange>修改</font> 支持`webpack5`


# 2.0.1
1. <font color=red>修复</font> 无法添加本地未安装的额外的外部引用路径


# 2.0.0
1. <font color=orange>修改</font> 组件库更名为`pandora`


# 1.5.0
1. <font color=orange>修改</font> 移除读取组件库`devDependencies`中的版本号


# 1.4.0
1. <font color=green>新增</font> `theme`配置主题
2. <font color=green>新增</font> 项目中可使用`externals.config.js`配置 externals 路径


# 1.4.0-dev
1. <font color=green>新增</font> `theme`配置主题


# 1.3.0
1. <font color=orange>修改</font> `skipCircularReference`跳出循环引用，默认值改为`true`。减少由于生产环境需要查找分块，而开发环境不需要，导致开发环境编译通过，而生产环境由于可能发生循环引用，导致编译不通过。该属性改为由用户开启，用于判断代码健壮性。


# 1.2.0
1. <font color=orange>修改</font> `debug`模式时外部链接脚本改为全部使用开发环境脚本，以便于调试与错误追踪。
2. <font color=orange>修改</font> `@babel/plugin-transform-modules-commonjs`改为必须添加，提示等级提升为错误


# 1.1.2
1. <font color=red>修复</font> 提示信息内容  


# 1.1.1
1. <font color=red>修复</font> 是否多入口判断逻辑  
2. <font color=orange>修改</font> 无论单入口、多入口都要求添加`@babel/plugin-transform-modules-commonjs`  


# 1.1.0
1. <font color=green>新增</font> 选项`skipCircularReference`可以跳出循环引用。不建议大家使用，还是希望大家不要有循环引用的代码。  


# 1.0.3
1. <font color=red>修复</font> 优化`debugFindEntry`去除冗余日志打印


# 1.0.2
1. <font color=blue>增强</font> 优化`debugFindEntry`打印跟踪循环引用日志，使其更容易获取有用信息


# 1.0.1
1. <font color=blue>增强</font> 添加未使用`@babel/plugin-transform-modules-commonjs`插件时逻辑
2. <font color=blue>增强</font> 添加校验 webpack 配置项
3. <font color=blue>增强</font> 添加打印跟踪循环引用日志
