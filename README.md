# Description
This application creates/updates the dns A record of a specified subdomain, using Hetzner dns API, setting the the WAN (outside) ip address of the machine that runs it.

## Run it
```bash
$ HETZNER_DNS_TOKEN=%TOKEN% node index subdomain1.example.com
```

## Run as a container
### Build the image
```bash
$ docker image build . -f node.Dockerfile -t hetzner-dns-update
```

### Execute the container
```
# Create and execute the container
$ docker container run --rm hetzner-dns-update subdomain1.example.com
```
or
```
# Create the container
docker container create --name hetzner-dns-update-sub1 -e HETZNER_DNS_TOKEN=%TOKEN% hetzner-dns-update subdomain1.example.com

# Execute the container everytime you need
docker container start -i hetzner-dns-update-sub1
```

### OTHER
```
# Run on remote container
export DOCKER_HOST=ssh://user@ip && docker image build . -f node.Dockerfile -t hetzner-dns-update
export DOCKER_HOST=ssh://user@ip && docker container create --name hetzner-dns-update-sub1 -e HETZNER_DNS_TOKEN=%TOKEN% hetzner-dns-update
export DOCKER_HOST=ssh://user@ip && docker container start -i hetzner-dns-update-sub1
```