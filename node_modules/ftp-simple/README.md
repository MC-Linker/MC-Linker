ftp-simple
===========
- Only FTP (Not support sftp. sftp use the [easy-ftp](https://www.npmjs.com/package/easy-ftp))
- 간단한 설정만으로 편리하게 FTP 기능을 이용할 수 있습니다.


Caution
===========
    If Node.js version is 8 or higher, use 0.3.0 or higher. Otherwise, use version 0.2.7.


Install
=======
Node.js version is 8 or higher
    
    npm install ftp-simple

Otherwise
    
    npm install ftp-simple@0.2.7





Usage
===========
```javascript
var FTP = require('ftp-simple');
var config = {
    host: '',
    port: 21,
    username: '', //or user
    password: ''  //or pass
};
var ftp = FTP.create(config);




//폴더 변경(directory change)
ftp.cd("/", function(err, path){});	

//파일 or 폴더 삭제(하위 파일 및 폴더 포함)(file or directory remove(recursive))
ftp.rm("/filename", function(err){});	

//폴더 생성(하위 폴더 포함 생성)(make directory)
ftp.mkdir("/directory", function(err){});	

//파일 or 폴더 이동 혹은 이름 변경(file or directory move or change filename)
ftp.mv("/filename", "/newFilename", function(err, newPath){});	

//폴더 내 파일목록 반환(show files in directory)
ftp.ls("/directory", function(err, list){});	

//ftp 서버상의 현재 작업 경로 반환(return server path)
ftp.pwd(function(err, path){});	

//서버에 파일이 존재하는지 여부 반환(boolean)
ftp.exist("/filename", function(exist){});


//파일 or 폴더 업로드(file or directory upload)
ftp.upload("/test.txt", "/test.txt", function(err){});  	//result => /test.txt
ftp.upload("/test.txt", "/test123.txt", function(err){});  //result => /test123.txt 
ftp.upload("/test.txt", "/", function(err){});			//result => /test.txt
ftp.upload("/directory", "/", function(err){});			//result => /directory

//Array - Object({local:'localPath', remote:'remotePath'})
var arr = [{local:"/test.txt", remote:"/test.txt"}, {local:"/test1.txt", remote:"/abcd/test2.txt"}, {local:"/directory", remote:"/"}];
ftp.upload(arr, function(err){});	// 2 arguments;
/* result
/test.txt
/abcd/test2.txt
/directory
*/

//Array - String
var arr = ["/test.txt", "/abcd/test2.txt", "/directory"];
ftp.upload(arr, "/", function(err){});	// 3 arguments;
/* result
/test.txt
/abcd/test2.txt
/directory
*/

//Array - Object and String
var arr = [{local:"/test.txt", remote:"/directory/test.txt"}, "/abcd/test2.txt", "/directory"];
ftp.upload(arr, "/", function(err){});	// 3 arguments;
/* result
/directory/test.txt
/abcd/test2.txt
/directory
*/


//파일 or 폴더 다운로드(file or directory download)
ftp.download("/test.txt", "/test.txt", function(err){});	//result => /test.txt
ftp.download("/test.txt", "/test123.txt", function(err){});	//result => /test123.txt 
ftp.download("/test.txt", "/", function(err){});		//result => /test.txt 
ftp.download("/directory", "/", function(err){});		//result => /directory 

//Array - Object({local:'localPath', remote:'remotePath'})
var arr = [{remote:"/test.txt", local:"/test.txt"}, {remote:"/test1.txt", local:"/abcd/test2.txt"}, {remote:"/directory", local:"/"}];
ftp.download(arr, function(err){});	// 2 arguments;
/* result
/test.txt
/abcd/test2.txt
/directory
*/

//Array - String
var arr = ["/test.txt", "/abcd/test2.txt", "/directory"];
ftp.download(arr, "/", function(err){});	// 3 arguments;
/* result
/test.txt
/abcd/test2.txt
/directory
*/

//Array - Object and String
var arr = [{remote:"/test.txt", local:"/directory/test.txt"}, "/abcd/test2.txt", "/directory"];
ftp.download(arr, "/", function(err){});	// 3 arguments;
/* result
/directory/test.txt
/abcd/test2.txt
/directory
*/



//접속 종료(disconnect)
ftp.close();	
```



API
===========
Static Method
-------
* **create**(< _object_ >config) 

    * host - _string_	- server domain or ip **Default:** '127.0.0.1'
    * port - _number_	- port (default : 21)
    * username - _string_ - username for authentication.
    * password - _string_	- password for authentication.
    * type - _string_ - This is a value that can use other settings.
    * secure - _boolean_ - Explicit FTPS over TLS, default: false
    * secureOptions - _object_ - Options for TLS, same as for `tls.connect()` in Node.js.


    [Node.js version is 8 or higher]

    Please refer to 'https://www.npmjs.com/package/basic-ftp' if this is 'ftp' and 'https://www.npmjs.com/package/ftp' if it is 'ftp2'. The 'secure' option is available regardless of 'type'.
    The default is 'ftp'.

    [Otherwise]

    Please refer to 'https://www.npmjs.com/package/jsftp' if this is 'ftp' and 'https://www.npmjs.com/package/ftp' if it is 'ftp2'. The 'secure' option is available for 'ftp2'. 
    The default is 'ftp'.



Methods
-------
* **cd**(< _string_ >path, < _function_ >callback) - Changes the working directory. callback has 1 parameter: < Error >err.

* **rm**(< _string_ >path, < _function_ >callback) - Deletes a file or directory(include child files) path on the server. callback has 1 parameter: < Error >err.
    
* **mkdir**(< _string_ >path, < _function_ >callback) - Creates a new directory recursive. callback has 1 parameter: < Error >err.

* **mv**(< _string_ >oldPath, < _string_ >newPath, < _function_ >callback) - Renames or Move oldPath to newPath on the server. callback has 2 parameter: < Error >err, < String >newPath.

* **ls**(< _string_ >path, < _function_ >callback) - Retrieves the directory listing of path. callback has 2 parameter: < Error >err, < Array >list.
    
    * name - _string_ - file name
    * size - _number_ - file size
    * type - _string_ - file type. 'd' => directory,  'f' => file
    * date - _date_ - file last modified date


* **pwd**(< _function_ >callback) - Retrieves the current working directory. callback has 2 parameters: < Error >err, < string >cwd.

* **exist**(< _function_ >callback) - whether a file or direcotry exists. callback has 1 parameters: < boolean >exist.

* **upload**(< _mixed_ >localPath, < _string_ >remotePath, < _function_ >callback) - Sends data to the server to be stored as remotePath. If direcotry path, include self directory and child files. If you want only child files, localPath is "/directory/**". callback has 1 parameter: < Error >err. 
    
    * file		- ex) upload("/test.txt", "/a/b/test.txt", ...)	=>  result : /a/b/test.txt
    * directory		- ex) upload("/directory", "/a/b", ...)		=>  result : /a/b/directory
    * only child files	- ex) upload("/directory/**", "/a/b", ...)	=>  result : /a/b/child files...
    * array	- ex) upload(["/directory/**", "/test.txt"], "/a/b", ...)	=>  result : "/a/b/test.txt" and "/a/b/child files..."


* **download**(< _mixed_ >remotePath, < _string_ >localPath, < _function_ >callback) - Retrieves a file or directory at path from the server. If directory path, include child files. callback has 1 parameter: < Error >err. 

	* file		- ex) download("/test.txt", "/a/b/test.txt", ...)	=>  result : /a/b/test.txt
    * directory		- ex) download("/directory", "/a/b", ...)		=>  result : /a/b/directory
    * only child files	- ex) download("/directory/**", "/a/b", ...)	=>  result : /a/b/child files...
    * array	- ex) download(["/directory/**", "/test.txt"], "/a/b", ...)	=>  result : "/a/b/test.txt" and "/a/b/child files..."
    

* **close**() - Closes the connection to the server after any/all enqueued commands have been executed.




Event
-------
* **open**(< _FTPClient_ >client) - Emitted when connection and authentication were sucessful.

* **close** - Emitted when the connection has fully closed.

* **error**(< _Error_ >err) - Emitted when the connection has fully closed.

* **upload**(< _string_ >uploadedRemotePath) - Emitted when file or directory uploaded.

* **download**(< _string_ >downloadedLocalPath) - Emitted when file or directory downloaded.



Examples
===========
```javascript
//Connect
var FTP = require('ftp-simple');
var config = {
    host: '',
    port: 21,
    username: '', //or user
    password: ''  //or pass
};
var ftp = FTP.create(config);




/* 
Ex) Directory structure
/test/test.txt
/test/child1
/test/child1/image.png
/test/child1/child2
/test/child1/child2/shell.sh
*/

//Case1. files Upload
//"/test/test.txt", "/test.txt"   or   "/test/test.txt", "/"
ftp.upload("/test/test.txt", "/test.txt", function(err){
	ftp.close();
});
/* result
/test.txt
*/



//Case2. child files Upload
// '/test/**' or '/test/*'
ftp.upload("/test/**", "/", function(err){
	ftp.close();
});
/* result
/test.txt
/child1
/child1/image.png
/child1/child2
/child1/child2/shell.sh
*/



//Case3. directory Upload
ftp.upload("/test", "/", function(err){
	ftp.close();	
});
/* result
/test/test.txt
/test/child1
/test/child1/image.png
/test/child1/child2
/test/child1/child2/shell.sh
*/

//Case4. Multi file Upload
//Array - Object({local:'localPath', remote:'remotePath'})
var arr = [{local:"/test.txt", remote:"/test.txt"}, {local:"/test1.txt", remote:"/abcd/test2.txt"}, {local:"/directory", remote:"/"}];
ftp.upload(arr, function(err){ftp.close();});	// 2 arguments;
/* result
/test.txt
/abcd/test2.txt
/directory
*/

//Array - String
var arr = ["/test.txt", "/abcd/test2.txt", "/directory"];
ftp.upload(arr, "/", function(err){ftp.close();});	// 3 arguments;
/* result
/test.txt
/abcd/test2.txt
/directory
*/

//Array - Object and String
var arr = [{local:"/test.txt", remote:"/directory/test.txt"}, "/abcd/test2.txt", "/directory"];
ftp.upload(arr, "/", function(err){ftp.close();});	// 3 arguments;
/* result
/directory/test.txt
/abcd/test2.txt
/directory
*/



//Case5. file download
//"/test/test.txt", "/test.txt"   or   "/test/test.txt", "/"
ftp.download("/test/test.txt", "/test.txt", function(err){
	ftp.close();	
});
/* result
/test.txt
*/



//Case6. direcotry download
ftp.download("/test", "/", function(err){
	ftp.close();	
});
/* result
/test/test.txt
/test/child1
/test/child1/image.png
/test/child1/child2
/test/child1/child2/shell.sh
*/



//Case7. Multi file download
//Array - Object({local:'localPath', remote:'remotePath'})
var arr = [{remote:"/test.txt", local:"/test.txt"}, {remote:"/test1.txt", local:"/abcd/test2.txt"}, {remote:"/directory", local:"/"}];
ftp.download(arr, function(err){ftp.close();});	// 2 arguments;
/* result
/test.txt
/abcd/test2.txt
/directory
*/

//Array - String
var arr = ["/test.txt", "/abcd/test2.txt", "/directory"];
ftp.download(arr, "/", function(err){ftp.close();});	// 3 arguments;
/* result
/test.txt
/abcd/test2.txt
/directory
*/

//Array - Object and String
var arr = [{remote:"/test.txt", local:"/directory/test.txt"}, "/abcd/test2.txt", "/directory"];
ftp.download(arr, "/", function(err){ftp.close();});	// 3 arguments;
/* result
/directory/test.txt
/abcd/test2.txt
/directory
*/
```
