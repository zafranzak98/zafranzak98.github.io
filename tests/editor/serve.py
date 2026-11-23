import http.server,os,sys
root=sys.argv[1]
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s,*a,**k): super().__init__(*a,directory=root,**k)
    def send_error(s,code,msg=None,explain=None):
        if code==404:
            body=open(os.path.join(root,"404.html"),"rb").read()
            s.send_response(404);s.send_header("Content-Type","text/html");s.send_header("Content-Length",str(len(body)));s.end_headers();s.wfile.write(body)
        else: super().send_error(code,msg,explain)
    def log_message(s,*a): pass
http.server.ThreadingHTTPServer(("",int(sys.argv[2])),H).serve_forever()
