from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.models.schemas import (
    GenerateConfigRequest,
    GenerateConfigResponse,
    NavigateRequest,
    NavigateResponse,
    RequestDetailResponse,
    RequestsResponse,
)
from app.services import playwright_service
from app.services.analysis_service import generate_config
import httpx
from fastapi import Request
from starlette.responses import HTMLResponse
from urllib.parse import urlparse

router = APIRouter()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "playwright_ready": playwright_service.get_startup_error() is None,
        "playwright_error": playwright_service.get_startup_error(),
    }


@router.post("/navigate", response_model=NavigateResponse)
async def navigate(payload: NavigateRequest):
    try:
        final_url = await playwright_service.navigate(payload.session_id, payload.url)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return NavigateResponse(status="ok", url=final_url, session_id=payload.session_id)


@router.get("/requests", response_model=RequestsResponse)
async def get_requests(session_id: str = Query(default="default")):
    requests = [
        {k: v for k, v in item.items() if k != "json"}
        for item in playwright_service.get_requests(session_id)
    ]
    return RequestsResponse(session_id=session_id, requests=requests)


@router.get("/request/{request_id}", response_model=RequestDetailResponse)
async def get_request_detail(request_id: str, session_id: str = Query(default="default")):
    request = playwright_service.get_request_by_id(session_id, request_id)
    # If the request is not found for the provided session, attempt a global lookup
    if not request:
        request = playwright_service.get_request_by_global_id(request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    return RequestDetailResponse(request=request)


@router.post("/generate-config", response_model=GenerateConfigResponse)
async def generate_config_endpoint(payload: GenerateConfigRequest):
    request = playwright_service.get_request_by_id(payload.session_id, payload.request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    urls = [entry["url"] for entry in playwright_service.get_requests(payload.session_id)]
    config = generate_config(request, request.get("json"), urls)
    return GenerateConfigResponse(config=config)





@router.get("/proxy")
async def proxy(url: str, request: Request):
        """Fetch a URL server-side, rewrite relative links and inject a small bridge
        script which posts DOM events to the parent window. This keeps the iframe
        same-origin with the app while loading external resources from their hosts.
        """
        # Forward incoming request headers to the upstream host where appropriate
        incoming_headers = {k: v for k, v in request.headers.items()}
        # Map pseudo-headers if present (some clients surface HTTP/2 pseudo-headers)
        if ":authority" in incoming_headers and "host" not in incoming_headers:
            incoming_headers["host"] = incoming_headers.get(":authority")

        # Remove hop-by-hop headers per RFC7230
        for h in [
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "transfer-encoding",
            "upgrade",
        ]:
            incoming_headers.pop(h, None)

        # Ensure Host header matches the target
        parsed_url = urlparse(url)
        incoming_headers["host"] = f"{parsed_url.netloc}"

        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            try:
                resp = await client.get(url, headers=incoming_headers)
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"Failed to fetch {url}: {exc}")

        content_type = resp.headers.get("content-type", "")
        body = resp.text

        if "text/html" not in content_type.lower():
            # For non-HTML resources just proxy the raw bytes with original content type
            return Response(content=resp.content, media_type=content_type)

        # Ensure absolute URLs for resources so they load correctly from original hosts
        parsed_url = urlparse(url)
        base = f"{parsed_url.scheme}://{parsed_url.netloc}"

        # Simple replacement for common attributes; not a full HTML parser but workable
        body = body.replace('href="/', f'href="{base}/')
        body = body.replace("href='/", f"href='{base}/")
        body = body.replace('src="/', f'src="{base}/')
        body = body.replace("src='/", f"src='{base}/")

        # Inject bridge script before </body>
        bridge = """
        <script>
        (function(){
            // Compute normalized coords and forward events to parent
            function normX(x){return x / window.innerWidth}
            function normY(y){return y / window.innerHeight}

            function send(evt){
                try{ window.parent.postMessage({type:'bridge_event', event:evt}, '*') }catch(e){}
            }

            document.addEventListener('click', function(e){
                var rect = {w: window.innerWidth, h: window.innerHeight};
                send({action:'click', x: normX(e.clientX), y: normY(e.clientY), tag: e.target.tagName});
            }, true);

            document.addEventListener('dblclick', function(e){
                send({action:'dblclick', x: normX(e.clientX), y: normY(e.clientY)});
            }, true);

            document.addEventListener('input', function(e){
                // For input events, include the current value
                try{ send({action:'type', x: normX(e.clientX||0), y: normY(e.clientY||0), text: e.target.value}); }catch(e){}
            }, true);

            document.addEventListener('keydown', function(e){
                // forward special keys
                var key = e.key;
                var printable = key.length === 1 && !e.ctrlKey && !e.metaKey;
                if(printable){ send({action:'type', text: key}); }
                else { send({action:'press', text: key}); }
            }, true);

            // Intercept link clicks and form submits to navigate Playwright instead
            document.addEventListener('click', function(e){
                var a = e.target.closest && e.target.closest('a');
                if(a && a.href){
                    e.preventDefault();
                    send({action:'navigate', url: a.href});
                }
            }, true);

            document.addEventListener('submit', function(e){
                try{ e.preventDefault(); }catch(e){}
                var form = e.target;
                var action = form.action || window.location.href;
                send({action:'navigate', url: action});
            }, true);
        })();
        </script>
        """

        if "</body>" in body:
                body = body.replace("</body>", bridge + "</body>")
        else:
                body = body + bridge

        return HTMLResponse(content=body, media_type="text/html")
