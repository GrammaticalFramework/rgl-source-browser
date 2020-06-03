FROM ubuntu:18.04

RUN apt-get update
RUN apt-get install -y git curl
RUN apt-get install -y nodejs npm
RUN npm install --global npx serve

# Install GF from binary
ARG GF_VERSION="3.10-1"
ARG GF_FILENAME="gf.deb"
RUN curl -s https://www.grammaticalframework.org/download/gf_${GF_VERSION}_amd64.deb -o ${GF_FILENAME}
RUN dpkg -i ${GF_FILENAME}
RUN rm -f ${GF_FILENAME}

# Obtain RGL, no need to build
WORKDIR /opt
RUN git clone https://github.com/GrammaticalFramework/gf-rgl.git

# Build tags
WORKDIR /opt/rgl-source-browser
COPY build-tags.sh .
ENV LC_ALL=C.UTF-8
ENV OS=gnu
ENV GF_RGL=/opt/gf-rgl
RUN ./build-tags.sh

# Copy RGL browser
COPY * ./

# Serve
EXPOSE 5000
CMD npx serve --no-clipboard
