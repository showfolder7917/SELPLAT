现在可直接使用：

cd /Users/showfolder/Documents/workSpace/SELF/SELPLAT && ./gradlew compileJava
cd /Users/showfolder/Documents/workSpace/SELF/SELPLAT && ./scripts/build/java/compile-uniauth.command
cd /Users/showfolder/Documents/workSpace/SELF/SELPLAT && ./scripts/test/java/test-uniauth.command
cd /Users/showfolder/Documents/workSpace/SELF/SELPLAT && ./scripts/startup/java/start-uniauth.command

./gradlew compileJava --no-daemon
./scripts/build/java/compile-uniauth.command
./scripts/test/java/test-uniauth.command
./scripts/startup/java/start-uniauth.command
curl -sSf http://localhost:8080/api/uniauth/users/verify/http

变更文件,文件夹时参照当前文件夹下索引修复相关内容

