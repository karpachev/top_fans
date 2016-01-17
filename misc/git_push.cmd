git status
@pause

@ECHO OFF
set COMMIT_MESSAGE="default message"
if NOT "%1undefined"=="undefined" (
   set COMMIT_MESSAGE= %1
)

git commit -a -m %COMMIT_MESSAGE%
git push

